/**
 * ADAPTIVE MODEL ROUTING
 *
 * Intelligently selects the best AI model for each task based on:
 * - Task complexity
 * - Required capabilities
 * - Cost optimization
 * - Latency requirements
 * - Historical performance
 *
 * Models available:
 * - Opus 4.6: Most capable, highest cost, best for complex reasoning
 * - Sonnet 4.6: Balanced performance/cost, good for most tasks
 * - Haiku 4.5: Fastest, lowest cost, good for simple tasks
 */

import type { ModelTier, StrategyStreamCallback } from './types';
import { MODEL_CONFIGS } from './constants';
import { logger } from '@/lib/logger';

const log = logger('AdaptiveModelRouter');

// =============================================================================
// TYPES
// =============================================================================

export interface TaskProfile {
  taskId: string;
  taskType: TaskType;
  complexity: ComplexityLevel;
  requiredCapabilities: Capability[];
  inputSize: 'small' | 'medium' | 'large' | 'very_large';
  urgency: 'critical' | 'high' | 'normal' | 'low';
  costSensitivity: 'high' | 'medium' | 'low';
  qualityRequirement: 'best' | 'good' | 'acceptable';
  context?: string;
}

export type TaskType =
  | 'analysis' // Deep analysis, reasoning
  | 'extraction' // Data extraction
  | 'summarization' // Summarizing content
  | 'classification' // Categorizing items
  | 'generation' // Creating content
  | 'verification' // Checking/validating
  | 'research' // Web research execution
  | 'synthesis' // Combining information
  | 'translation' // Language translation
  | 'code' // Code generation/analysis
  | 'conversation'; // Chat/dialogue

export type ComplexityLevel =
  | 'trivial' // Simple, straightforward
  | 'simple' // Basic reasoning
  | 'moderate' // Multiple steps
  | 'complex' // Deep reasoning required
  | 'extreme'; // Cutting-edge capability needed

export type Capability =
  | 'reasoning' // Complex logical reasoning
  | 'creativity' // Creative generation
  | 'precision' // High accuracy needed
  | 'speed' // Fast response needed
  | 'vision' // Image understanding
  | 'code' // Code generation
  | 'math' // Mathematical computation
  | 'synthesis' // Information synthesis
  | 'extraction' // Data extraction
  | 'conversation'; // Natural conversation

export interface RoutingDecision {
  taskId: string;
  selectedModel: ModelTier;
  modelId: string;
  confidence: number;
  reasoning: string[];
  estimatedCost: number;
  estimatedLatency: 'fast' | 'medium' | 'slow';
  alternatives: Array<{
    model: ModelTier;
    score: number;
    tradeoff: string;
  }>;
  timestamp: number;
}

export interface PerformanceRecord {
  taskId: string;
  taskType: TaskType;
  modelUsed: ModelTier;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  qualityScore?: number;
  cost: number;
  timestamp: number;
}

export interface RouterConfig {
  defaultModel: ModelTier;
  costBudget?: number;
  preferSpeed: boolean;
  preferQuality: boolean;
  learningEnabled: boolean;
}

// =============================================================================
// MODEL CAPABILITIES MAPPING
// =============================================================================

const MODEL_CAPABILITIES: Record<
  ModelTier,
  {
    capabilities: Capability[];
    maxComplexity: ComplexityLevel;
    speed: number; // 1-10
    quality: number; // 1-10
    costEfficiency: number; // 1-10
  }
> = {
  opus: {
    capabilities: [
      'reasoning',
      'creativity',
      'precision',
      'vision',
      'code',
      'math',
      'synthesis',
      'extraction',
      'conversation',
    ],
    maxComplexity: 'extreme',
    speed: 4,
    quality: 10,
    costEfficiency: 2,
  },
  sonnet: {
    capabilities: [
      'reasoning',
      'creativity',
      'precision',
      'vision',
      'code',
      'math',
      'synthesis',
      'extraction',
      'conversation',
    ],
    maxComplexity: 'complex',
    speed: 7,
    quality: 8,
    costEfficiency: 7,
  },
  haiku: {
    capabilities: ['speed', 'extraction', 'conversation'],
    maxComplexity: 'moderate',
    speed: 10,
    quality: 6,
    costEfficiency: 10,
  },
};

const COMPLEXITY_SCORES: Record<ComplexityLevel, number> = {
  trivial: 1,
  simple: 2,
  moderate: 3,
  complex: 4,
  extreme: 5,
};

const TASK_COMPLEXITY_HINTS: Record<TaskType, ComplexityLevel> = {
  classification: 'simple',
  extraction: 'simple',
  summarization: 'moderate',
  translation: 'moderate',
  conversation: 'moderate',
  research: 'moderate',
  verification: 'complex',
  generation: 'complex',
  analysis: 'complex',
  synthesis: 'complex',
  code: 'complex',
};

// =============================================================================
// ADAPTIVE MODEL ROUTER CLASS
// =============================================================================

export class AdaptiveModelRouter {
  private config: RouterConfig;
  private performanceHistory: PerformanceRecord[] = [];
  private onStream?: StrategyStreamCallback;

  constructor(config?: Partial<RouterConfig>, onStream?: StrategyStreamCallback) {
    this.config = {
      defaultModel: 'sonnet',
      preferSpeed: false,
      preferQuality: true,
      learningEnabled: true,
      ...config,
    };
    this.onStream = onStream;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Route a task to the best model
   */
  route(task: TaskProfile): RoutingDecision {
    const scores = this.calculateModelScores(task);
    const bestModel = this.selectBestModel(scores, task);

    const decision: RoutingDecision = {
      taskId: task.taskId,
      selectedModel: bestModel.model,
      modelId: MODEL_CONFIGS[bestModel.model].id,
      confidence: bestModel.confidence,
      reasoning: bestModel.reasoning,
      estimatedCost: this.estimateCost(task, bestModel.model),
      estimatedLatency: this.estimateLatency(bestModel.model),
      alternatives: scores
        .filter((s) => s.model !== bestModel.model)
        .map((s) => ({
          model: s.model,
          score: s.score,
          tradeoff: this.getTradeoffDescription(s.model, bestModel.model),
        })),
      timestamp: Date.now(),
    };

    this.emitEvent(`Routed task "${task.taskId}" to ${bestModel.model}: ${bestModel.reasoning[0]}`);

    log.info('Model routing decision', {
      taskId: task.taskId,
      taskType: task.taskType,
      complexity: task.complexity,
      selectedModel: bestModel.model,
      confidence: bestModel.confidence,
    });

    return decision;
  }

  /**
   * Route multiple tasks optimally (batch optimization)
   */
  routeBatch(tasks: TaskProfile[]): RoutingDecision[] {
    const decisions: RoutingDecision[] = [];
    const remainingBudget = this.config.costBudget;

    // Sort by urgency and quality requirement
    const sortedTasks = [...tasks].sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const qualityOrder = { best: 0, good: 1, acceptable: 2 };
      return (
        urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
        qualityOrder[a.qualityRequirement] - qualityOrder[b.qualityRequirement]
      );
    });

    let usedBudget = 0;

    for (const task of sortedTasks) {
      // If we have a budget, check if we can afford the best model
      if (remainingBudget !== undefined) {
        const adjustedTask = { ...task };
        const estimatedBestCost = this.estimateCost(task, 'opus');

        if (usedBudget + estimatedBestCost > remainingBudget) {
          // Force cost sensitivity
          adjustedTask.costSensitivity = 'high';
        }

        const decision = this.route(adjustedTask);
        usedBudget += decision.estimatedCost;
        decisions.push(decision);
      } else {
        decisions.push(this.route(task));
      }
    }

    return decisions;
  }

  /**
   * Automatically profile a task based on content
   */
  profileTask(
    taskId: string,
    taskType: TaskType,
    content: string,
    options?: Partial<TaskProfile>
  ): TaskProfile {
    // Estimate input size
    const tokenEstimate = content.length / 4; // Rough estimate
    const inputSize: TaskProfile['inputSize'] =
      tokenEstimate < 500
        ? 'small'
        : tokenEstimate < 2000
          ? 'medium'
          : tokenEstimate < 8000
            ? 'large'
            : 'very_large';

    // Estimate complexity from content and task type
    let complexity = TASK_COMPLEXITY_HINTS[taskType] || 'moderate';

    // Adjust based on content analysis
    const complexityIndicators = [
      { pattern: /\b(analyze|evaluate|compare|synthesize)\b/i, boost: 1 },
      { pattern: /\b(complex|detailed|comprehensive|thorough)\b/i, boost: 1 },
      { pattern: /\b(simple|quick|brief|just)\b/i, boost: -1 },
      { pattern: /\b(reason|think|consider|weigh)\b/i, boost: 1 },
    ];

    let complexityAdjustment = 0;
    for (const indicator of complexityIndicators) {
      if (indicator.pattern.test(content)) {
        complexityAdjustment += indicator.boost;
      }
    }

    if (complexityAdjustment > 1) {
      complexity = this.increaseComplexity(complexity);
    } else if (complexityAdjustment < -1) {
      complexity = this.decreaseComplexity(complexity);
    }

    // Infer required capabilities
    const requiredCapabilities: Capability[] = [];

    if (/\b(reason|think|analyze|why|because)\b/i.test(content)) {
      requiredCapabilities.push('reasoning');
    }
    if (/\b(create|generate|write|compose)\b/i.test(content)) {
      requiredCapabilities.push('creativity');
    }
    if (/\b(exact|precise|accurate|correct)\b/i.test(content)) {
      requiredCapabilities.push('precision');
    }
    if (/\b(fast|quick|urgent|asap)\b/i.test(content)) {
      requiredCapabilities.push('speed');
    }
    if (/\b(image|picture|photo|screenshot|chart)\b/i.test(content)) {
      requiredCapabilities.push('vision');
    }
    if (/\b(code|function|class|implement|debug)\b/i.test(content)) {
      requiredCapabilities.push('code');
    }
    if (/\b(calculate|compute|math|formula)\b/i.test(content)) {
      requiredCapabilities.push('math');
    }

    return {
      taskId,
      taskType,
      complexity,
      requiredCapabilities,
      inputSize,
      urgency: options?.urgency || 'normal',
      costSensitivity: options?.costSensitivity || 'medium',
      qualityRequirement: options?.qualityRequirement || 'good',
      context: content.slice(0, 200),
    };
  }

  /**
   * Record performance for learning
   */
  recordPerformance(record: PerformanceRecord): void {
    this.performanceHistory.push(record);

    // Keep only last 1000 records
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }

    log.debug('Performance recorded', {
      taskId: record.taskId,
      model: record.modelUsed,
      success: record.success,
      latencyMs: record.latencyMs,
    });
  }

  /**
   * Get routing statistics
   */
  getStatistics(): {
    totalRouted: number;
    modelDistribution: Record<ModelTier, number>;
    averageLatency: Record<ModelTier, number>;
    successRate: Record<ModelTier, number>;
    totalCost: number;
  } {
    const stats = {
      totalRouted: this.performanceHistory.length,
      modelDistribution: { opus: 0, sonnet: 0, haiku: 0 } as Record<ModelTier, number>,
      averageLatency: { opus: 0, sonnet: 0, haiku: 0 } as Record<ModelTier, number>,
      successRate: { opus: 0, sonnet: 0, haiku: 0 } as Record<ModelTier, number>,
      totalCost: 0,
    };

    const latencySums: Record<ModelTier, number> = { opus: 0, sonnet: 0, haiku: 0 };
    const successCounts: Record<ModelTier, number> = { opus: 0, sonnet: 0, haiku: 0 };

    for (const record of this.performanceHistory) {
      stats.modelDistribution[record.modelUsed]++;
      latencySums[record.modelUsed] += record.latencyMs;
      if (record.success) successCounts[record.modelUsed]++;
      stats.totalCost += record.cost;
    }

    for (const model of ['opus', 'sonnet', 'haiku'] as ModelTier[]) {
      const count = stats.modelDistribution[model];
      if (count > 0) {
        stats.averageLatency[model] = latencySums[model] / count;
        stats.successRate[model] = successCounts[model] / count;
      }
    }

    return stats;
  }

  /**
   * Update router configuration
   */
  updateConfig(config: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private calculateModelScores(task: TaskProfile): Array<{
    model: ModelTier;
    score: number;
    confidence: number;
    reasoning: string[];
  }> {
    const scores: Array<{
      model: ModelTier;
      score: number;
      confidence: number;
      reasoning: string[];
    }> = [];

    for (const model of ['opus', 'sonnet', 'haiku'] as ModelTier[]) {
      const result = this.scoreModel(model, task);
      scores.push({ model, ...result });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  private scoreModel(
    model: ModelTier,
    task: TaskProfile
  ): { score: number; confidence: number; reasoning: string[] } {
    const capabilities = MODEL_CAPABILITIES[model];
    const reasoning: string[] = [];
    let score = 50; // Base score
    let confidence = 0.7;

    // Check if model can handle complexity
    const taskComplexity = COMPLEXITY_SCORES[task.complexity];
    const modelMaxComplexity = COMPLEXITY_SCORES[capabilities.maxComplexity];

    if (taskComplexity > modelMaxComplexity) {
      score -= 30;
      confidence -= 0.2;
      reasoning.push(`${model} may struggle with ${task.complexity} complexity`);
    } else if (taskComplexity <= modelMaxComplexity - 2) {
      score += 10;
      reasoning.push(`${model} is well-suited for this complexity level`);
    }

    // Check required capabilities
    const missingCapabilities = task.requiredCapabilities.filter(
      (c) => !capabilities.capabilities.includes(c)
    );
    if (missingCapabilities.length > 0) {
      score -= missingCapabilities.length * 15;
      confidence -= missingCapabilities.length * 0.1;
      reasoning.push(`${model} lacks: ${missingCapabilities.join(', ')}`);
    }

    // Apply preferences
    if (this.config.preferSpeed) {
      score += capabilities.speed * 2;
      reasoning.push(`Speed factor: +${capabilities.speed * 2}`);
    }

    if (this.config.preferQuality) {
      score += capabilities.quality * 2;
      reasoning.push(`Quality factor: +${capabilities.quality * 2}`);
    }

    // Cost sensitivity
    if (task.costSensitivity === 'high') {
      score += capabilities.costEfficiency * 3;
      reasoning.push(`Cost efficiency: +${capabilities.costEfficiency * 3}`);
    } else if (task.costSensitivity === 'low') {
      score += capabilities.quality * 2;
      reasoning.push(`Quality prioritized over cost`);
    }

    // Quality requirement
    if (task.qualityRequirement === 'best' && capabilities.quality < 9) {
      score -= (9 - capabilities.quality) * 5;
      reasoning.push(`Quality requirement penalty`);
    }

    // Urgency
    if (task.urgency === 'critical' || task.urgency === 'high') {
      if (capabilities.speed < 7) {
        score -= (7 - capabilities.speed) * 5;
        reasoning.push(`Urgency penalty for slower model`);
      }
    }

    // Input size consideration
    if (task.inputSize === 'very_large' && model === 'haiku') {
      score -= 10;
      reasoning.push(`Large input may be better for more capable model`);
    }

    // Apply historical learning
    if (this.config.learningEnabled) {
      const historicalBonus = this.getHistoricalBonus(model, task.taskType);
      score += historicalBonus;
      if (historicalBonus !== 0) {
        reasoning.push(
          `Historical performance: ${historicalBonus > 0 ? '+' : ''}${historicalBonus}`
        );
      }
    }

    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score));
    confidence = Math.max(0.3, Math.min(1, confidence));

    return { score, confidence, reasoning };
  }

  private selectBestModel(
    scores: Array<{ model: ModelTier; score: number; confidence: number; reasoning: string[] }>,
    task: TaskProfile
  ): { model: ModelTier; confidence: number; reasoning: string[] } {
    // If scores are very close, prefer cost-effective option
    const best = scores[0];
    const second = scores[1];

    if (second && best.score - second.score < 5) {
      // Within 5 points, consider cost
      const bestCost = MODEL_CONFIGS[best.model].costPerMillionInput;
      const secondCost = MODEL_CONFIGS[second.model].costPerMillionInput;

      if (secondCost < bestCost * 0.5 && task.costSensitivity !== 'low') {
        return {
          model: second.model,
          confidence: second.confidence,
          reasoning: [
            `Selected ${second.model} over ${best.model} due to similar quality at lower cost`,
            ...second.reasoning,
          ],
        };
      }
    }

    return {
      model: best.model,
      confidence: best.confidence,
      reasoning: [`${best.model} is the best fit for this task`, ...best.reasoning],
    };
  }

  private getHistoricalBonus(model: ModelTier, taskType: TaskType): number {
    const relevantRecords = this.performanceHistory.filter(
      (r) => r.modelUsed === model && r.taskType === taskType
    );

    if (relevantRecords.length < 3) return 0;

    const successRate = relevantRecords.filter((r) => r.success).length / relevantRecords.length;
    const avgQuality =
      relevantRecords
        .filter((r) => r.qualityScore !== undefined)
        .reduce((sum, r) => sum + (r.qualityScore || 0), 0) /
      relevantRecords.filter((r) => r.qualityScore !== undefined).length;

    return Math.round(successRate * 10 + (avgQuality || 0.5) * 10 - 10);
  }

  private estimateCost(task: TaskProfile, model: ModelTier): number {
    const config = MODEL_CONFIGS[model];
    const inputTokens =
      task.inputSize === 'small'
        ? 500
        : task.inputSize === 'medium'
          ? 2000
          : task.inputSize === 'large'
            ? 8000
            : 32000;
    const outputTokens = inputTokens * 0.5; // Rough estimate

    return (
      (inputTokens / 1_000_000) * config.costPerMillionInput +
      (outputTokens / 1_000_000) * config.costPerMillionOutput
    );
  }

  private estimateLatency(model: ModelTier): 'fast' | 'medium' | 'slow' {
    const speed = MODEL_CAPABILITIES[model].speed;
    return speed >= 8 ? 'fast' : speed >= 5 ? 'medium' : 'slow';
  }

  private getTradeoffDescription(altModel: ModelTier, selectedModel: ModelTier): string {
    const altCaps = MODEL_CAPABILITIES[altModel];
    const selCaps = MODEL_CAPABILITIES[selectedModel];

    if (altCaps.costEfficiency > selCaps.costEfficiency) {
      return `${altModel} is cheaper but may have lower quality`;
    }
    if (altCaps.speed > selCaps.speed) {
      return `${altModel} is faster but may have lower quality`;
    }
    if (altCaps.quality > selCaps.quality) {
      return `${altModel} has higher quality but is more expensive`;
    }
    return `${altModel} offers different tradeoffs`;
  }

  private increaseComplexity(level: ComplexityLevel): ComplexityLevel {
    const order: ComplexityLevel[] = ['trivial', 'simple', 'moderate', 'complex', 'extreme'];
    const idx = order.indexOf(level);
    return order[Math.min(idx + 1, order.length - 1)];
  }

  private decreaseComplexity(level: ComplexityLevel): ComplexityLevel {
    const order: ComplexityLevel[] = ['trivial', 'simple', 'moderate', 'complex', 'extreme'];
    const idx = order.indexOf(level);
    return order[Math.max(idx - 1, 0)];
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'synthesis_progress',
        message: `[Router] ${message}`,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createAdaptiveModelRouter(
  config?: Partial<RouterConfig>,
  onStream?: StrategyStreamCallback
): AdaptiveModelRouter {
  return new AdaptiveModelRouter(config, onStream);
}
