/**
 * QUALITY CONTROL AGENT - Monitor & Kill Switch
 *
 * Uses Opus 4.5 to monitor all agent work and can trigger the kill switch
 * if something goes wrong. Has absolute authority over the operation.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  QualityControlState,
  QualityIssue,
  QualityIssueType,
  QualityAction,
  Finding,
  CostTracker,
  StrategyLimits,
  StrategyStreamCallback,
  KillReason,
} from './types';
import { CLAUDE_OPUS_45, QUALITY_CONTROL_PROMPT, DEFAULT_LIMITS } from './constants';
import { logger } from '@/lib/logger';

const log = logger('QualityControl');

// =============================================================================
// QC CHECK RESULT
// =============================================================================

interface QCCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  action: QualityAction;
  issues: QualityIssue[];
  metrics: {
    budgetUsed: number;
    timeElapsed: number;
    agentsComplete: number;
    agentsTotal: number;
    errorRate: number;
    avgConfidence: number;
  };
  overallQualityScore: number;
  recommendation: string;
}

// =============================================================================
// QUALITY CONTROL CLASS
// =============================================================================

export class QualityControl {
  private client: Anthropic;
  private state: QualityControlState;
  private limits: StrategyLimits;
  private onStream?: StrategyStreamCallback;
  private startTime: number;
  private model = CLAUDE_OPUS_45;

  constructor(
    client: Anthropic,
    limits: StrategyLimits = DEFAULT_LIMITS,
    onStream?: StrategyStreamCallback
  ) {
    this.client = client;
    this.limits = limits;
    this.onStream = onStream;
    this.startTime = Date.now();
    this.state = {
      status: 'pending',
      issuesFound: [],
      killSwitchTriggered: false,
      overallQualityScore: 1.0,
      lastCheck: Date.now(),
    };
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Run a quality check on the current state
   */
  async runCheck(
    costTracker: CostTracker,
    agentsComplete: number,
    agentsTotal: number,
    agentsFailed: number,
    findings: Finding[]
  ): Promise<QCCheckResult> {
    this.state.status = 'researching';
    this.state.lastCheck = Date.now();

    const elapsedMinutes = (Date.now() - this.startTime) / 1000 / 60;
    const budgetPercent = (costTracker.totalCost / this.limits.maxBudget) * 100;
    const timePercent = (elapsedMinutes / this.limits.maxTimeMinutes) * 100;
    const errorRate = agentsTotal > 0 ? agentsFailed / agentsTotal : 0;
    const completionPercent = agentsTotal > 0 ? (agentsComplete / agentsTotal) * 100 : 0;

    // Calculate average confidence
    const avgConfidence =
      findings.length > 0
        ? findings.reduce((sum, f) => {
            const conf = f.confidence === 'high' ? 0.9 : f.confidence === 'medium' ? 0.7 : 0.4;
            return sum + conf;
          }, 0) / findings.length
        : 0;

    // Run automated checks
    const issues: QualityIssue[] = [];

    // Budget check
    if (budgetPercent >= 95) {
      issues.push(
        this.createIssue('critical', 'budget_warning', 'Budget limit reached (95%+)', 'kill')
      );
    } else if (budgetPercent >= 75) {
      issues.push(
        this.createIssue(
          'warning',
          'budget_warning',
          `Budget at ${budgetPercent.toFixed(0)}%`,
          'continue'
        )
      );
    }

    // Time check
    if (timePercent >= 95) {
      issues.push(
        this.createIssue('critical', 'time_warning', 'Time limit reached (95%+)', 'kill')
      );
    } else if (timePercent >= 75) {
      issues.push(
        this.createIssue(
          'warning',
          'time_warning',
          `Time at ${timePercent.toFixed(0)}%`,
          'continue'
        )
      );
    }

    // Error rate check
    if (errorRate >= 0.3) {
      issues.push(
        this.createIssue('critical', 'high_error_rate', 'Error rate exceeds 30%', 'kill')
      );
    } else if (errorRate >= this.limits.maxErrorRate) {
      issues.push(
        this.createIssue(
          'warning',
          'high_error_rate',
          `Error rate at ${(errorRate * 100).toFixed(0)}%`,
          'pause_and_review'
        )
      );
    }

    // Confidence check
    if (avgConfidence < 0.5 && findings.length >= 10) {
      issues.push(
        this.createIssue(
          'warning',
          'low_confidence',
          'Average finding confidence is low',
          'spawn_more_agents'
        )
      );
    }

    // Progress check (budget spent vs completion)
    if (budgetPercent > 50 && completionPercent < 25) {
      issues.push(
        this.createIssue(
          'warning',
          'insufficient_coverage',
          'High budget usage with low completion',
          'redirect_focus'
        )
      );
    }

    // Determine overall status and action
    const criticalIssues = issues.filter((i) => i.severity === 'critical');
    const warningIssues = issues.filter((i) => i.severity === 'warning');

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let action: QualityAction = 'continue';

    if (criticalIssues.length > 0) {
      status = 'critical';
      action = criticalIssues[0].suggestedAction;
    } else if (warningIssues.length > 0) {
      status = 'warning';
      action = warningIssues[0].suggestedAction;
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(
      budgetPercent,
      timePercent,
      errorRate,
      avgConfidence,
      completionPercent
    );

    // Update state
    this.state.issuesFound = [...this.state.issuesFound, ...issues];
    this.state.overallQualityScore = qualityScore;
    this.state.status = status === 'critical' ? 'failed' : 'complete';

    // Check for kill conditions
    if (action === 'kill') {
      this.triggerKillSwitch(issues[0]?.description || 'Quality check failed');
    }

    const result: QCCheckResult = {
      status,
      action,
      issues,
      metrics: {
        budgetUsed: budgetPercent,
        timeElapsed: elapsedMinutes * 60, // Convert to seconds
        agentsComplete,
        agentsTotal,
        errorRate,
        avgConfidence,
      },
      overallQualityScore: qualityScore,
      recommendation: this.generateRecommendation(status, action, issues),
    };

    // Emit event
    if (issues.length > 0) {
      this.emitEvent('quality_issue', `Quality check: ${status}`, {
        issue: issues[0],
      });
    } else {
      this.emitEvent('quality_check', `Quality check passed: ${qualityScore.toFixed(2)}`, {});
    }

    log.info('Quality check complete', {
      status,
      action,
      issueCount: issues.length,
      qualityScore,
    });

    return result;
  }

  /**
   * Deep analysis using AI (for complex situations)
   */
  async runDeepAnalysis(currentState: string, findings: Finding[]): Promise<QCCheckResult> {
    const stateWithFindings = `${currentState}\n\nFINDINGS:\n${JSON.stringify(findings.slice(0, 50), null, 2)}`;

    const prompt = QUALITY_CONTROL_PROMPT.replace('{CURRENT_STATE}', stateWithFindings);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0.5,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: 'Analyze the current state and provide your quality assessment.',
        },
      ],
    });

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Parse the AI response
    return this.parseDeepAnalysisResponse(textContent);
  }

  /**
   * Trigger the kill switch
   */
  triggerKillSwitch(reason: string): void {
    this.state.killSwitchTriggered = true;
    this.state.killReason = this.determineKillReason(reason);
    this.state.status = 'failed';

    log.warn('Kill switch triggered', { reason, killReason: this.state.killReason });

    this.emitEvent('kill_switch', `Kill switch triggered: ${reason}`, {
      killReason: this.state.killReason,
    });
  }

  /**
   * Get current state
   */
  getState(): QualityControlState {
    return { ...this.state };
  }

  /**
   * Check if killed
   */
  isKilled(): boolean {
    return this.state.killSwitchTriggered;
  }

  /**
   * Reset for new run
   */
  reset(): void {
    this.state = {
      status: 'pending',
      issuesFound: [],
      killSwitchTriggered: false,
      overallQualityScore: 1.0,
      lastCheck: Date.now(),
    };
    this.startTime = Date.now();
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Create a quality issue
   */
  private createIssue(
    severity: 'critical' | 'warning' | 'info',
    type: QualityIssueType,
    description: string,
    suggestedAction: QualityAction
  ): QualityIssue {
    return {
      id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      severity,
      type,
      description,
      affectedAgents: [],
      suggestedAction,
      resolved: false,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    budgetPercent: number,
    timePercent: number,
    errorRate: number,
    avgConfidence: number,
    completionPercent: number
  ): number {
    // Weighted scoring
    const weights = {
      budget: 0.2, // 20% - budget efficiency
      time: 0.1, // 10% - time efficiency
      errors: 0.25, // 25% - error rate
      confidence: 0.25, // 25% - finding confidence
      completion: 0.2, // 20% - completion progress
    };

    // Calculate component scores (0-1)
    const budgetScore = Math.max(0, 1 - (budgetPercent / 100) * 0.5); // Penalize high usage
    const timeScore = Math.max(0, 1 - (timePercent / 100) * 0.3);
    const errorScore = 1 - errorRate;
    const confidenceScore = avgConfidence;
    const completionScore = completionPercent / 100;

    // Weighted sum
    const score =
      budgetScore * weights.budget +
      timeScore * weights.time +
      errorScore * weights.errors +
      confidenceScore * weights.confidence +
      completionScore * weights.completion;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate recommendation text
   */
  private generateRecommendation(
    status: 'healthy' | 'warning' | 'critical',
    action: QualityAction,
    issues: QualityIssue[]
  ): string {
    if (status === 'healthy') {
      return 'All systems nominal. Continue execution.';
    }

    if (status === 'critical') {
      const issue = issues.find((i) => i.severity === 'critical');
      return `Critical issue detected: ${issue?.description}. Recommended action: ${action}`;
    }

    const warnings = issues.filter((i) => i.severity === 'warning');
    return `${warnings.length} warning(s) detected. Highest priority: ${warnings[0]?.description}. Recommended action: ${action}`;
  }

  /**
   * Determine kill reason from description
   */
  private determineKillReason(reason: string): KillReason {
    const lower = reason.toLowerCase();
    if (lower.includes('budget')) return 'budget_exceeded';
    if (lower.includes('time')) return 'time_exceeded';
    if (lower.includes('error')) return 'error_rate_exceeded';
    if (lower.includes('cancel')) return 'user_cancelled';
    if (lower.includes('loop')) return 'infinite_loop_detected';
    return 'quality_control_failed';
  }

  /**
   * Parse deep analysis response
   */
  private parseDeepAnalysisResponse(response: string): QCCheckResult {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      return this.createDefaultCheckResult();
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        status: parsed.status || 'healthy',
        action: parsed.action || 'continue',
        issues: (parsed.issues || []).map((i: Record<string, unknown>) => ({
          id: `issue_${Date.now()}`,
          severity: i.severity || 'info',
          type: i.type || 'low_confidence',
          description: String(i.description || ''),
          affectedAgents: Array.isArray(i.affectedAgents) ? i.affectedAgents : [],
          suggestedAction: i.suggestedAction || 'continue',
          resolved: false,
          timestamp: Date.now(),
        })),
        metrics: {
          budgetUsed: Number(parsed.metrics?.budgetUsed) || 0,
          timeElapsed: Number(parsed.metrics?.timeElapsed) || 0,
          agentsComplete: Number(parsed.metrics?.agentsComplete) || 0,
          agentsTotal: Number(parsed.metrics?.agentsTotal) || 0,
          errorRate: Number(parsed.metrics?.errorRate) || 0,
          avgConfidence: Number(parsed.metrics?.avgConfidence) || 0.5,
        },
        overallQualityScore: Number(parsed.overallQualityScore) || 0.5,
        recommendation: String(parsed.recommendation || ''),
      };
    } catch (error) {
      log.error('Failed to parse QC response', { error });
      return this.createDefaultCheckResult();
    }
  }

  /**
   * Create default check result
   */
  private createDefaultCheckResult(): QCCheckResult {
    return {
      status: 'healthy',
      action: 'continue',
      issues: [],
      metrics: {
        budgetUsed: 0,
        timeElapsed: 0,
        agentsComplete: 0,
        agentsTotal: 0,
        errorRate: 0,
        avgConfidence: 0.5,
      },
      overallQualityScore: 0.5,
      recommendation: 'Unable to parse response, continuing with caution.',
    };
  }

  /**
   * Emit stream event
   */
  private emitEvent(
    type: 'quality_check' | 'quality_issue' | 'kill_switch',
    message: string,
    data: Record<string, unknown>
  ): void {
    if (this.onStream) {
      this.onStream({
        type,
        message,
        timestamp: Date.now(),
        data: data as Parameters<StrategyStreamCallback>[0]['data'],
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createQualityControl(
  client: Anthropic,
  limits?: StrategyLimits,
  onStream?: StrategyStreamCallback
): QualityControl {
  return new QualityControl(client, limits, onStream);
}
