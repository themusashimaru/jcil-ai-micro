/**
 * FULL AUDIT TRAIL & EXPLAINABILITY
 *
 * Comprehensive logging and explanation system for AI decisions.
 * Records every significant action, decision, and reasoning step.
 *
 * Key capabilities:
 * - Decision logging with full context
 * - Reasoning chain recording
 * - Model input/output tracking
 * - Cost and performance attribution
 * - Explainability reports
 * - Audit queries and retrieval
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { StrategyStreamCallback, ModelTier } from './types';
import { logger } from '@/lib/logger';

const log = logger('AuditTrail');

// =============================================================================
// TYPES
// =============================================================================

export interface AuditEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: AuditEventType;
  timestamp: number;
  component: string;
  action: string;
  details: Record<string, unknown>;
  modelUsed?: ModelTier;
  inputSummary?: string;
  outputSummary?: string;
  reasoning?: string[];
  cost?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  parentEventId?: string; // For nested/related events
}

export type AuditEventType =
  | 'decision' // A decision was made
  | 'inference' // AI inference was performed
  | 'tool_call' // A tool was executed
  | 'data_access' // Data was retrieved/stored
  | 'validation' // Data was validated
  | 'transformation' // Data was transformed
  | 'routing' // Request was routed
  | 'error' // An error occurred
  | 'user_input' // User provided input
  | 'system_action'; // System took an action

export interface DecisionExplanation {
  decisionId: string;
  decisionType: string;
  summary: string;
  reasoning: string[];
  alternatives: Array<{
    option: string;
    whyNotChosen: string;
    score?: number;
  }>;
  confidenceFactors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    description: string;
  }>;
  dataUsed: string[];
  modelContribution: string;
  humanReadableSummary: string;
}

export interface ReasoningChain {
  chainId: string;
  sessionId: string;
  title: string;
  steps: ReasoningStep[];
  conclusion: string;
  overallConfidence: number;
  timestamp: number;
}

export interface ReasoningStep {
  stepNumber: number;
  action: string;
  input: string;
  output: string;
  reasoning: string;
  confidence: number;
  modelUsed?: string;
  duration?: number;
}

export interface ExplainabilityReport {
  reportId: string;
  sessionId: string;
  userId: string;
  generatedAt: number;
  summary: {
    totalDecisions: number;
    totalInferences: number;
    totalCost: number;
    totalDuration: number;
    successRate: number;
  };
  decisionBreakdown: Array<{
    component: string;
    decisionCount: number;
    avgConfidence: number;
  }>;
  keyDecisions: DecisionExplanation[];
  reasoningChains: ReasoningChain[];
  dataFlow: DataFlowNode[];
  recommendations: string[];
}

export interface DataFlowNode {
  id: string;
  type: 'input' | 'process' | 'output' | 'storage';
  name: string;
  description: string;
  connectedTo: string[];
  dataVolume?: number;
}

export interface AuditQuery {
  sessionId?: string;
  userId?: string;
  eventTypes?: AuditEventType[];
  component?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  successOnly?: boolean;
  minCost?: number;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
  aggregations: {
    totalCost: number;
    avgLatency: number;
    successRate: number;
    eventTypeCounts: Record<string, number>;
    componentCounts: Record<string, number>;
  };
}

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createServiceClient(url, key);
}

// =============================================================================
// AUDIT TRAIL CLASS
// =============================================================================

export class AuditTrail {
  private sessionId: string;
  private userId: string;
  private events: AuditEvent[] = [];
  private reasoningChains: ReasoningChain[] = [];
  private currentChain?: ReasoningChain;
  private onStream?: StrategyStreamCallback;
  private persistToDb: boolean;

  constructor(
    sessionId: string,
    userId: string,
    options?: { persistToDb?: boolean; onStream?: StrategyStreamCallback }
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.persistToDb = options?.persistToDb ?? true;
    this.onStream = options?.onStream;
  }

  // ===========================================================================
  // EVENT LOGGING
  // ===========================================================================

  /**
   * Log a decision event
   */
  async logDecision(
    component: string,
    action: string,
    details: {
      reasoning: string[];
      alternatives?: Array<{ option: string; whyNotChosen: string }>;
      confidence?: number;
      dataUsed?: string[];
    },
    options?: {
      modelUsed?: ModelTier;
      cost?: number;
      latencyMs?: number;
      parentEventId?: string;
    }
  ): Promise<string> {
    const event = await this.logEvent('decision', component, action, {
      ...details,
      success: true,
      ...options,
    });
    return event.id;
  }

  /**
   * Log an inference event (AI model call)
   */
  async logInference(
    component: string,
    action: string,
    details: {
      inputSummary: string;
      outputSummary: string;
      modelUsed: ModelTier;
      inputTokens?: number;
      outputTokens?: number;
    },
    options?: {
      cost?: number;
      latencyMs?: number;
      parentEventId?: string;
      success?: boolean;
      errorMessage?: string;
    }
  ): Promise<string> {
    const event = await this.logEvent('inference', component, action, {
      ...details,
      success: options?.success ?? true,
      ...options,
    });
    return event.id;
  }

  /**
   * Log a tool execution event
   */
  async logToolCall(
    component: string,
    toolName: string,
    details: {
      input: Record<string, unknown>;
      output?: Record<string, unknown>;
      success: boolean;
      errorMessage?: string;
    },
    options?: {
      latencyMs?: number;
      parentEventId?: string;
    }
  ): Promise<string> {
    const event = await this.logEvent('tool_call', component, toolName, {
      ...details,
      ...options,
    });
    return event.id;
  }

  /**
   * Log an error event
   */
  async logError(
    component: string,
    action: string,
    error: Error | string,
    context?: Record<string, unknown>
  ): Promise<string> {
    const errorMessage = error instanceof Error ? error.message : error;
    const event = await this.logEvent('error', component, action, {
      errorMessage,
      context,
      success: false,
    });
    return event.id;
  }

  /**
   * Generic event logging
   */
  async logEvent(
    eventType: AuditEventType,
    component: string,
    action: string,
    details: Record<string, unknown> & {
      success?: boolean;
      modelUsed?: ModelTier;
      inputSummary?: string;
      outputSummary?: string;
      reasoning?: string[];
      cost?: number;
      latencyMs?: number;
      errorMessage?: string;
      parentEventId?: string;
    }
  ): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      sessionId: this.sessionId,
      userId: this.userId,
      eventType,
      timestamp: Date.now(),
      component,
      action,
      details: { ...details },
      modelUsed: details.modelUsed,
      inputSummary: details.inputSummary,
      outputSummary: details.outputSummary,
      reasoning: details.reasoning,
      cost: details.cost,
      latencyMs: details.latencyMs,
      success: details.success ?? true,
      errorMessage: details.errorMessage,
      parentEventId: details.parentEventId,
    };

    // Add to local store
    this.events.push(event);

    // Add to current reasoning chain if active
    if (this.currentChain && eventType === 'inference') {
      this.currentChain.steps.push({
        stepNumber: this.currentChain.steps.length + 1,
        action: action,
        input: details.inputSummary || '',
        output: details.outputSummary || '',
        reasoning: details.reasoning?.join('; ') || '',
        confidence: 0.8,
        modelUsed: details.modelUsed,
        duration: details.latencyMs,
      });
    }

    // Persist to database
    if (this.persistToDb) {
      await this.persistEvent(event);
    }

    // Emit stream event for visibility
    if (this.onStream && eventType === 'decision') {
      this.onStream({
        type: 'synthesis_progress',
        message: `[Audit] ${component}: ${action}`,
        timestamp: Date.now(),
      });
    }

    return event;
  }

  // ===========================================================================
  // REASONING CHAINS
  // ===========================================================================

  /**
   * Start a new reasoning chain
   */
  startReasoningChain(title: string): string {
    const chain: ReasoningChain = {
      chainId: `chain_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sessionId: this.sessionId,
      title,
      steps: [],
      conclusion: '',
      overallConfidence: 0,
      timestamp: Date.now(),
    };

    this.currentChain = chain;
    return chain.chainId;
  }

  /**
   * Add a step to the current reasoning chain
   */
  addReasoningStep(step: Omit<ReasoningStep, 'stepNumber'>): void {
    if (!this.currentChain) {
      log.warn('No active reasoning chain');
      return;
    }

    this.currentChain.steps.push({
      ...step,
      stepNumber: this.currentChain.steps.length + 1,
    });
  }

  /**
   * Complete the current reasoning chain
   */
  completeReasoningChain(conclusion: string, confidence: number): void {
    if (!this.currentChain) {
      log.warn('No active reasoning chain');
      return;
    }

    this.currentChain.conclusion = conclusion;
    this.currentChain.overallConfidence = confidence;
    this.reasoningChains.push(this.currentChain);
    this.currentChain = undefined;
  }

  // ===========================================================================
  // EXPLAINABILITY
  // ===========================================================================

  /**
   * Generate explanation for a specific decision
   */
  explainDecision(eventId: string): DecisionExplanation | null {
    const event = this.events.find((e) => e.id === eventId && e.eventType === 'decision');
    if (!event) return null;

    const details = event.details as Record<string, unknown>;

    return {
      decisionId: event.id,
      decisionType: event.action,
      summary: `${event.component} made a ${event.action} decision`,
      reasoning: (details.reasoning as string[]) || [],
      alternatives: (details.alternatives as Array<{ option: string; whyNotChosen: string }>) || [],
      confidenceFactors: this.extractConfidenceFactors(event),
      dataUsed: (details.dataUsed as string[]) || [],
      modelContribution: event.modelUsed
        ? `This decision was made using ${event.modelUsed} model`
        : 'No AI model was used for this decision',
      humanReadableSummary: this.generateHumanReadableSummary(event),
    };
  }

  /**
   * Generate full explainability report
   */
  generateReport(): ExplainabilityReport {
    const decisions = this.events.filter((e) => e.eventType === 'decision');
    const inferences = this.events.filter((e) => e.eventType === 'inference');

    const totalCost = this.events.reduce((sum, e) => sum + (e.cost || 0), 0);
    const totalDuration = this.events.reduce((sum, e) => sum + (e.latencyMs || 0), 0);
    const successCount = this.events.filter((e) => e.success).length;

    // Component breakdown
    const componentStats = new Map<string, { count: number; totalConfidence: number }>();
    for (const event of decisions) {
      const stats = componentStats.get(event.component) || { count: 0, totalConfidence: 0 };
      stats.count++;
      stats.totalConfidence += (event.details.confidence as number) || 0.7;
      componentStats.set(event.component, stats);
    }

    // Key decisions (high impact or low confidence)
    const keyDecisions = decisions
      .filter((e) => {
        const conf = (e.details.confidence as number) || 0.7;
        return conf < 0.6 || (e.details.reasoning as string[])?.length > 3;
      })
      .slice(0, 10)
      .map((e) => this.explainDecision(e.id)!)
      .filter(Boolean);

    // Data flow
    const dataFlow = this.buildDataFlow();

    return {
      reportId: `report_${Date.now()}`,
      sessionId: this.sessionId,
      userId: this.userId,
      generatedAt: Date.now(),
      summary: {
        totalDecisions: decisions.length,
        totalInferences: inferences.length,
        totalCost,
        totalDuration,
        successRate: this.events.length > 0 ? successCount / this.events.length : 1,
      },
      decisionBreakdown: Array.from(componentStats.entries()).map(([component, stats]) => ({
        component,
        decisionCount: stats.count,
        avgConfidence: stats.count > 0 ? stats.totalConfidence / stats.count : 0,
      })),
      keyDecisions,
      reasoningChains: this.reasoningChains,
      dataFlow,
      recommendations: this.generateRecommendations(),
    };
  }

  // ===========================================================================
  // QUERYING
  // ===========================================================================

  /**
   * Query audit events
   */
  query(query: AuditQuery): AuditQueryResult {
    let filtered = [...this.events];

    // Apply filters
    if (query.sessionId) {
      filtered = filtered.filter((e) => e.sessionId === query.sessionId);
    }
    if (query.userId) {
      filtered = filtered.filter((e) => e.userId === query.userId);
    }
    if (query.eventTypes && query.eventTypes.length > 0) {
      filtered = filtered.filter((e) => query.eventTypes!.includes(e.eventType));
    }
    if (query.component) {
      filtered = filtered.filter((e) => e.component === query.component);
    }
    if (query.fromTimestamp) {
      filtered = filtered.filter((e) => e.timestamp >= query.fromTimestamp!);
    }
    if (query.toTimestamp) {
      filtered = filtered.filter((e) => e.timestamp <= query.toTimestamp!);
    }
    if (query.successOnly) {
      filtered = filtered.filter((e) => e.success);
    }
    if (query.minCost !== undefined) {
      filtered = filtered.filter((e) => (e.cost || 0) >= query.minCost!);
    }

    // Calculate aggregations
    const totalCost = filtered.reduce((sum, e) => sum + (e.cost || 0), 0);
    const latencies = filtered.filter((e) => e.latencyMs).map((e) => e.latencyMs!);
    const avgLatency =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const successRate =
      filtered.length > 0 ? filtered.filter((e) => e.success).length / filtered.length : 1;

    const eventTypeCounts: Record<string, number> = {};
    const componentCounts: Record<string, number> = {};
    for (const e of filtered) {
      eventTypeCounts[e.eventType] = (eventTypeCounts[e.eventType] || 0) + 1;
      componentCounts[e.component] = (componentCounts[e.component] || 0) + 1;
    }

    // Apply pagination
    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      events: paginated,
      total,
      hasMore: offset + limit < total,
      aggregations: {
        totalCost,
        avgLatency,
        successRate,
        eventTypeCounts,
        componentCounts,
      },
    };
  }

  /**
   * Get events from database
   */
  async queryFromDatabase(query: AuditQuery): Promise<AuditQueryResult> {
    const supabase = getServiceClient();
    if (!supabase) {
      return this.query(query); // Fall back to in-memory
    }

    let q = supabase.from('strategy_audit_events').select('*', { count: 'exact' });

    if (query.sessionId) q = q.eq('session_id', query.sessionId);
    if (query.userId) q = q.eq('user_id', query.userId);
    if (query.eventTypes && query.eventTypes.length > 0) {
      q = q.in('event_type', query.eventTypes);
    }
    if (query.component) q = q.eq('component', query.component);
    if (query.fromTimestamp) {
      q = q.gte('timestamp', new Date(query.fromTimestamp).toISOString());
    }
    if (query.toTimestamp) {
      q = q.lte('timestamp', new Date(query.toTimestamp).toISOString());
    }
    if (query.successOnly) q = q.eq('success', true);

    q = q.order('timestamp', { ascending: false });

    if (query.limit) q = q.limit(query.limit);
    if (query.offset) q = q.range(query.offset, query.offset + (query.limit || 100) - 1);

    const { data, count, error } = await q;

    if (error) {
      log.error('Database query failed', { error });
      return this.query(query);
    }

    const events: AuditEvent[] = (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      sessionId: String(row.session_id),
      userId: String(row.user_id),
      eventType: String(row.event_type) as AuditEventType,
      timestamp: new Date(row.timestamp as string).getTime(),
      component: String(row.component),
      action: String(row.action),
      details: (row.details as Record<string, unknown>) || {},
      modelUsed: row.model_used ? (String(row.model_used) as ModelTier) : undefined,
      inputSummary: row.input_summary ? String(row.input_summary) : undefined,
      outputSummary: row.output_summary ? String(row.output_summary) : undefined,
      reasoning: row.reasoning as string[] | undefined,
      cost: row.cost ? Number(row.cost) : undefined,
      latencyMs: row.latency_ms ? Number(row.latency_ms) : undefined,
      success: Boolean(row.success),
      errorMessage: row.error_message ? String(row.error_message) : undefined,
      parentEventId: row.parent_event_id ? String(row.parent_event_id) : undefined,
    }));

    return {
      events,
      total: count || events.length,
      hasMore: (query.offset || 0) + events.length < (count || 0),
      aggregations: {
        totalCost: events.reduce((sum, e) => sum + (e.cost || 0), 0),
        avgLatency: 0,
        successRate: events.length > 0 ? events.filter((e) => e.success).length / events.length : 1,
        eventTypeCounts: {},
        componentCounts: {},
      },
    };
  }

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================

  /**
   * Persist all events to database
   */
  async persistAll(): Promise<void> {
    const supabase = getServiceClient();
    if (!supabase) return;

    for (const event of this.events) {
      await this.persistEvent(event);
    }
  }

  /**
   * Get all local events
   */
  getEvents(): AuditEvent[] {
    return [...this.events];
  }

  /**
   * Get reasoning chains
   */
  getReasoningChains(): ReasoningChain[] {
    return [...this.reasoningChains];
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private async persistEvent(event: AuditEvent): Promise<void> {
    const supabase = getServiceClient();
    if (!supabase) return;

    try {
      await supabase.from('strategy_audit_events').upsert({
        id: event.id,
        session_id: event.sessionId,
        user_id: event.userId,
        event_type: event.eventType,
        timestamp: new Date(event.timestamp).toISOString(),
        component: event.component,
        action: event.action,
        details: event.details,
        model_used: event.modelUsed,
        input_summary: event.inputSummary,
        output_summary: event.outputSummary,
        reasoning: event.reasoning,
        cost: event.cost,
        latency_ms: event.latencyMs,
        success: event.success,
        error_message: event.errorMessage,
        parent_event_id: event.parentEventId,
      });
    } catch (error) {
      log.error('Failed to persist audit event', { error, eventId: event.id });
    }
  }

  private extractConfidenceFactors(event: AuditEvent): DecisionExplanation['confidenceFactors'] {
    const factors: DecisionExplanation['confidenceFactors'] = [];
    const details = event.details as Record<string, unknown>;

    if (details.reasoning && Array.isArray(details.reasoning)) {
      for (const reason of details.reasoning) {
        factors.push({
          factor: String(reason),
          impact: 'positive',
          weight: 1 / (details.reasoning as string[]).length,
          description: String(reason),
        });
      }
    }

    return factors;
  }

  private generateHumanReadableSummary(event: AuditEvent): string {
    const reasoning = (event.details.reasoning as string[]) || [];
    const alternatives = (event.details.alternatives as Array<{ option: string }>) || [];

    let summary = `The ${event.component} component decided to ${event.action}. `;

    if (reasoning.length > 0) {
      summary += `This was because: ${reasoning[0]}. `;
    }

    if (alternatives.length > 0) {
      summary += `Other options considered included ${alternatives.map((a) => a.option).join(', ')}. `;
    }

    if (event.modelUsed) {
      summary += `The ${event.modelUsed} AI model was used to make this decision.`;
    }

    return summary;
  }

  private buildDataFlow(): DataFlowNode[] {
    const nodes: DataFlowNode[] = [];
    const nodeMap = new Map<string, DataFlowNode>();

    // Create nodes from events
    for (const event of this.events) {
      const nodeId = `${event.component}_${event.eventType}`;

      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, {
          id: nodeId,
          type: event.eventType === 'inference' ? 'process' : 'process',
          name: `${event.component}: ${event.eventType}`,
          description: event.action,
          connectedTo: [],
          dataVolume: 0,
        });
      }

      const node = nodeMap.get(nodeId)!;
      node.dataVolume = (node.dataVolume || 0) + 1;

      // Connect to parent if exists
      if (event.parentEventId) {
        const parentEvent = this.events.find((e) => e.id === event.parentEventId);
        if (parentEvent) {
          const parentNodeId = `${parentEvent.component}_${parentEvent.eventType}`;
          const parentNode = nodeMap.get(parentNodeId);
          if (parentNode && !parentNode.connectedTo.includes(nodeId)) {
            parentNode.connectedTo.push(nodeId);
          }
        }
      }
    }

    nodes.push(...nodeMap.values());
    return nodes;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check error rate
    const errorRate = this.events.filter((e) => !e.success).length / this.events.length;
    if (errorRate > 0.1) {
      recommendations.push(
        `High error rate detected (${(errorRate * 100).toFixed(1)}%). Review error logs for patterns.`
      );
    }

    // Check cost distribution
    const totalCost = this.events.reduce((sum, e) => sum + (e.cost || 0), 0);
    const opusCost = this.events
      .filter((e) => e.modelUsed === 'opus')
      .reduce((sum, e) => sum + (e.cost || 0), 0);
    if (opusCost > totalCost * 0.7) {
      recommendations.push('Consider using smaller models for simpler tasks to reduce costs.');
    }

    // Check latency
    const avgLatency =
      this.events.filter((e) => e.latencyMs).reduce((sum, e) => sum + (e.latencyMs || 0), 0) /
      this.events.filter((e) => e.latencyMs).length;
    if (avgLatency > 5000) {
      recommendations.push('High average latency detected. Consider parallelizing operations.');
    }

    return recommendations;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createAuditTrail(
  sessionId: string,
  userId: string,
  options?: { persistToDb?: boolean; onStream?: StrategyStreamCallback }
): AuditTrail {
  return new AuditTrail(sessionId, userId, options);
}
