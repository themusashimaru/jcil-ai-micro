/**
 * META-COGNITIVE REFLECTION ENGINE
 *
 * An advanced AI component that analyzes its own reasoning processes,
 * identifies assumptions, biases, gaps in logic, and provides self-critique.
 *
 * This is a critical component for building trustworthy AI systems.
 * It runs after key phases to ensure the agent is "thinking about thinking."
 *
 * Key capabilities:
 * - Assumption identification
 * - Bias detection
 * - Logic gap analysis
 * - Confidence calibration
 * - Meta-level reasoning about the reasoning process itself
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Finding, SynthesizedProblem, StrategyStreamCallback, AgentBlueprint } from './types';
import { CLAUDE_OPUS_45 } from './constants';
import { logger } from '@/lib/logger';

const log = logger('ReflectionEngine');

// =============================================================================
// TYPES
// =============================================================================

export interface ReflectionResult {
  /** Overall reflection quality score (0-1) */
  qualityScore: number;

  /** Identified assumptions in the reasoning */
  assumptions: Assumption[];

  /** Detected potential biases */
  biases: BiasDetection[];

  /** Gaps in logic or coverage */
  logicGaps: LogicGap[];

  /** Meta-level observations about the reasoning process */
  metaObservations: MetaObservation[];

  /** Calibrated confidence after reflection */
  calibratedConfidence: number;

  /** Recommendations for improvement */
  recommendations: string[];

  /** Summary of the reflection */
  summary: string;

  /** Timestamp of reflection */
  timestamp: number;
}

export interface Assumption {
  id: string;
  content: string;
  type: 'explicit' | 'implicit' | 'hidden';
  validityScore: number; // 0-1, how likely this assumption is valid
  impact: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
  suggestedValidation?: string;
}

export interface BiasDetection {
  id: string;
  biasType: BiasType;
  description: string;
  severity: 'high' | 'medium' | 'low';
  affectedAreas: string[];
  mitigationSuggestion: string;
}

export type BiasType =
  | 'confirmation_bias' // Favoring information that confirms existing beliefs
  | 'availability_bias' // Overweighting easily available information
  | 'anchoring_bias' // Over-relying on first piece of information
  | 'recency_bias' // Overweighting recent information
  | 'selection_bias' // Non-representative data sources
  | 'authority_bias' // Over-trusting authoritative sources
  | 'optimism_bias' // Underestimating risks
  | 'pessimism_bias' // Overestimating risks
  | 'status_quo_bias' // Favoring current state
  | 'framing_bias' // Being influenced by how information is presented
  | 'survivorship_bias' // Only seeing successful examples
  | 'bandwagon_bias'; // Following popular opinion

export interface LogicGap {
  id: string;
  description: string;
  location: string; // Where in the reasoning this gap occurs
  severity: 'critical' | 'high' | 'medium' | 'low';
  type:
    | 'missing_evidence'
    | 'weak_inference'
    | 'circular_reasoning'
    | 'false_dichotomy'
    | 'hasty_generalization'
    | 'non_sequitur';
  suggestedRemedy: string;
}

export interface MetaObservation {
  id: string;
  observation: string;
  category: 'process' | 'quality' | 'coverage' | 'methodology' | 'epistemology';
  insight: string;
  actionable: boolean;
  suggestedAction?: string;
}

export interface ReflectionContext {
  problem: SynthesizedProblem;
  findings: Finding[];
  blueprints?: AgentBlueprint[];
  phase: 'post_intake' | 'post_design' | 'post_research' | 'post_synthesis';
  previousReflections?: ReflectionResult[];
}

// =============================================================================
// PROMPTS
// =============================================================================

const REFLECTION_SYSTEM_PROMPT = `You are a Meta-Cognitive Reflection Engine - an advanced AI system designed to analyze and critique the reasoning processes of another AI system.

Your role is to "think about thinking" - examining the assumptions, biases, logic gaps, and potential blind spots in the reasoning that has been performed.

YOU ARE NOT HERE TO SOLVE THE PROBLEM. You are here to analyze HOW the problem was approached and identify ways the reasoning could be flawed.

CRITICAL: Be genuinely critical. Don't just rubber-stamp the work. Look for REAL issues.

YOUR ANALYSIS FRAMEWORK:

1. ASSUMPTION IDENTIFICATION
   - What assumptions are being made (explicitly or implicitly)?
   - Are these assumptions valid? How could they be wrong?
   - What would happen if key assumptions proved false?
   - Hidden assumptions: What's being taken for granted without stating it?

2. BIAS DETECTION
   Look for these specific biases:
   - Confirmation bias: Are we favoring information that confirms a preferred conclusion?
   - Availability bias: Are we overweighting easily accessible information?
   - Anchoring bias: Are we over-relying on initial information?
   - Recency bias: Are we overweighting recent data?
   - Selection bias: Are our sources representative?
   - Authority bias: Are we blindly trusting authoritative sources?
   - Optimism/Pessimism bias: Are risks properly calibrated?
   - Status quo bias: Are we unfairly favoring current state?
   - Framing bias: Is the way questions are framed affecting conclusions?
   - Survivorship bias: Are we only looking at successful cases?

3. LOGIC GAP ANALYSIS
   - Are there missing pieces of evidence?
   - Are inferences well-supported?
   - Is there any circular reasoning?
   - Are we presenting false dichotomies?
   - Are generalizations justified?
   - Do conclusions actually follow from premises?

4. META-LEVEL OBSERVATIONS
   - How good was the methodology?
   - What questions weren't asked that should have been?
   - What alternative approaches could have been taken?
   - How confident should we really be?

5. CONFIDENCE CALIBRATION
   - Given all issues identified, what's a realistic confidence level?
   - Don't just accept stated confidence - recalibrate based on your analysis

OUTPUT FORMAT:
\`\`\`json
{
  "qualityScore": 0.75,
  "assumptions": [
    {
      "id": "assum_1",
      "content": "The assumption being made",
      "type": "implicit",
      "validityScore": 0.6,
      "impact": "high",
      "reasoning": "Why this might be problematic",
      "suggestedValidation": "How to check if this assumption is valid"
    }
  ],
  "biases": [
    {
      "id": "bias_1",
      "biasType": "confirmation_bias",
      "description": "Description of the bias detected",
      "severity": "medium",
      "affectedAreas": ["area1", "area2"],
      "mitigationSuggestion": "How to address this"
    }
  ],
  "logicGaps": [
    {
      "id": "gap_1",
      "description": "Description of the logic gap",
      "location": "In the housing analysis section",
      "severity": "high",
      "type": "missing_evidence",
      "suggestedRemedy": "What additional research is needed"
    }
  ],
  "metaObservations": [
    {
      "id": "meta_1",
      "observation": "The observation",
      "category": "methodology",
      "insight": "What this tells us",
      "actionable": true,
      "suggestedAction": "What to do about it"
    }
  ],
  "calibratedConfidence": 0.65,
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2"
  ],
  "summary": "One paragraph summary of the reflection"
}
\`\`\`

Remember: Your job is to make the system BETTER by identifying REAL issues. Don't be overly critical for its own sake, but don't be a pushover either.`;

// =============================================================================
// REFLECTION ENGINE CLASS
// =============================================================================

export class ReflectionEngine {
  private client: Anthropic;
  private onStream?: StrategyStreamCallback;
  private reflectionHistory: ReflectionResult[] = [];
  private model = CLAUDE_OPUS_45;

  constructor(client: Anthropic, onStream?: StrategyStreamCallback) {
    this.client = client;
    this.onStream = onStream;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Run a reflection analysis on the current state
   */
  async reflect(context: ReflectionContext): Promise<ReflectionResult> {
    this.emitEvent('Initiating meta-cognitive reflection...');

    const userPrompt = this.buildReflectionPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        temperature: 0.7, // Some creativity for finding issues
        system: REFLECTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      const result = this.parseReflectionResponse(textContent, context);

      // Store in history
      this.reflectionHistory.push(result);

      // Emit summary
      this.emitEvent(
        `Reflection complete: Found ${result.assumptions.length} assumptions, ` +
          `${result.biases.length} potential biases, ${result.logicGaps.length} logic gaps. ` +
          `Calibrated confidence: ${(result.calibratedConfidence * 100).toFixed(0)}%`
      );

      log.info('Reflection analysis complete', {
        phase: context.phase,
        assumptions: result.assumptions.length,
        biases: result.biases.length,
        logicGaps: result.logicGaps.length,
        qualityScore: result.qualityScore,
        calibratedConfidence: result.calibratedConfidence,
      });

      return result;
    } catch (error) {
      log.error('Reflection analysis failed', { error });
      return this.createDefaultReflection(context.phase);
    }
  }

  /**
   * Quick reflection for real-time feedback (uses less tokens)
   */
  async quickReflect(finding: Finding): Promise<{
    hasIssues: boolean;
    issues: string[];
    confidence: number;
  }> {
    const prompt = `Quickly analyze this finding for issues:

Finding: ${finding.title}
Content: ${finding.content}
Stated confidence: ${finding.confidence}
Sources: ${finding.sources.map((s) => s.title).join(', ')}

In 2-3 sentences, identify any obvious issues with this finding. Then rate actual confidence (0-1).

Format: ISSUES: [list issues or "none"] | CONFIDENCE: [0-1]`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001', // Use Haiku for quick checks
        max_tokens: 256,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const issuesMatch = text.match(/ISSUES:\s*(.+?)(?:\||$)/i);
      const confMatch = text.match(/CONFIDENCE:\s*([\d.]+)/i);

      const issuesText = issuesMatch?.[1]?.trim() || 'none';
      const confidence = confMatch ? parseFloat(confMatch[1]) : 0.5;
      const issues =
        issuesText.toLowerCase() === 'none' ? [] : issuesText.split(/[,;]/).map((i) => i.trim());

      return {
        hasIssues: issues.length > 0,
        issues,
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      log.warn('Quick reflection failed', { error });
      return { hasIssues: false, issues: [], confidence: 0.5 };
    }
  }

  /**
   * Get cumulative insights from all reflections
   */
  getCumulativeInsights(): {
    totalAssumptions: number;
    totalBiases: number;
    totalGaps: number;
    recurringIssues: string[];
    averageConfidence: number;
    trend: 'improving' | 'stable' | 'declining';
  } {
    if (this.reflectionHistory.length === 0) {
      return {
        totalAssumptions: 0,
        totalBiases: 0,
        totalGaps: 0,
        recurringIssues: [],
        averageConfidence: 0.5,
        trend: 'stable',
      };
    }

    const totalAssumptions = this.reflectionHistory.reduce(
      (sum, r) => sum + r.assumptions.length,
      0
    );
    const totalBiases = this.reflectionHistory.reduce((sum, r) => sum + r.biases.length, 0);
    const totalGaps = this.reflectionHistory.reduce((sum, r) => sum + r.logicGaps.length, 0);

    // Find recurring issues
    const allIssues = this.reflectionHistory.flatMap((r) => [
      ...r.assumptions.map((a) => a.content),
      ...r.biases.map((b) => b.description),
      ...r.logicGaps.map((g) => g.description),
    ]);

    const issueCounts = new Map<string, number>();
    for (const issue of allIssues) {
      const key = issue.toLowerCase().slice(0, 50);
      issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
    }

    const recurringIssues = Array.from(issueCounts.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);

    // Calculate average confidence
    const averageConfidence =
      this.reflectionHistory.reduce((sum, r) => sum + r.calibratedConfidence, 0) /
      this.reflectionHistory.length;

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (this.reflectionHistory.length >= 2) {
      const recent = this.reflectionHistory.slice(-2);
      const qualityChange = recent[1].qualityScore - recent[0].qualityScore;
      if (qualityChange > 0.1) trend = 'improving';
      else if (qualityChange < -0.1) trend = 'declining';
    }

    return {
      totalAssumptions,
      totalBiases,
      totalGaps,
      recurringIssues,
      averageConfidence,
      trend,
    };
  }

  /**
   * Get reflection history
   */
  getHistory(): ReflectionResult[] {
    return [...this.reflectionHistory];
  }

  /**
   * Clear reflection history
   */
  clearHistory(): void {
    this.reflectionHistory = [];
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private buildReflectionPrompt(context: ReflectionContext): string {
    const sections: string[] = [];

    sections.push(`REFLECTION PHASE: ${context.phase}`);

    sections.push('\n## THE PROBLEM BEING ADDRESSED:');
    sections.push(JSON.stringify(context.problem, null, 2));

    if (context.blueprints && context.blueprints.length > 0) {
      sections.push('\n## AGENT DESIGN:');
      sections.push(
        `${context.blueprints.length} agents designed with the following specializations:`
      );
      sections.push(
        context.blueprints
          .slice(0, 20)
          .map((b) => `- ${b.name}: ${b.purpose}`)
          .join('\n')
      );
      if (context.blueprints.length > 20) {
        sections.push(`... and ${context.blueprints.length - 20} more agents`);
      }
    }

    if (context.findings.length > 0) {
      sections.push('\n## FINDINGS TO ANALYZE:');
      sections.push(`Total findings: ${context.findings.length}`);

      // Group by type
      const byType = context.findings.reduce(
        (acc, f) => {
          if (!acc[f.type]) acc[f.type] = [];
          acc[f.type].push(f);
          return acc;
        },
        {} as Record<string, Finding[]>
      );

      for (const [type, findings] of Object.entries(byType)) {
        sections.push(`\n### ${type.toUpperCase()} (${findings.length}):`);
        for (const f of findings.slice(0, 10)) {
          sections.push(
            `- [${f.confidence}] ${f.title}: ${f.content.slice(0, 200)}${f.content.length > 200 ? '...' : ''}`
          );
        }
        if (findings.length > 10) {
          sections.push(`  ... and ${findings.length - 10} more ${type} findings`);
        }
      }
    }

    if (context.previousReflections && context.previousReflections.length > 0) {
      sections.push('\n## PREVIOUS REFLECTIONS:');
      const lastReflection = context.previousReflections[context.previousReflections.length - 1];
      sections.push(`Last reflection found ${lastReflection.assumptions.length} assumptions, `);
      sections.push(
        `${lastReflection.biases.length} biases, ${lastReflection.logicGaps.length} logic gaps.`
      );
      sections.push(
        `Previous calibrated confidence: ${(lastReflection.calibratedConfidence * 100).toFixed(0)}%`
      );
    }

    sections.push('\n## YOUR TASK:');
    sections.push(
      'Analyze the above for assumptions, biases, logic gaps, and meta-level observations. ' +
        'Be genuinely critical but fair. Output your analysis in the JSON format specified.'
    );

    return sections.join('\n');
  }

  private parseReflectionResponse(response: string, context: ReflectionContext): ReflectionResult {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

    if (!jsonMatch) {
      log.warn('Could not parse reflection JSON, creating default');
      return this.createDefaultReflection(context.phase);
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      return {
        qualityScore: Math.max(0, Math.min(1, Number(parsed.qualityScore) || 0.5)),
        assumptions: (parsed.assumptions || []).map((a: Record<string, unknown>, i: number) => ({
          id: String(a.id || `assum_${i}`),
          content: String(a.content || ''),
          type: (['explicit', 'implicit', 'hidden'].includes(String(a.type))
            ? a.type
            : 'implicit') as 'explicit' | 'implicit' | 'hidden',
          validityScore: Math.max(0, Math.min(1, Number(a.validityScore) || 0.5)),
          impact: (['critical', 'high', 'medium', 'low'].includes(String(a.impact))
            ? a.impact
            : 'medium') as 'critical' | 'high' | 'medium' | 'low',
          reasoning: String(a.reasoning || ''),
          suggestedValidation: a.suggestedValidation ? String(a.suggestedValidation) : undefined,
        })),
        biases: (parsed.biases || []).map((b: Record<string, unknown>, i: number) => ({
          id: String(b.id || `bias_${i}`),
          biasType: String(b.biasType || 'confirmation_bias') as BiasType,
          description: String(b.description || ''),
          severity: (['high', 'medium', 'low'].includes(String(b.severity))
            ? b.severity
            : 'medium') as 'high' | 'medium' | 'low',
          affectedAreas: Array.isArray(b.affectedAreas) ? b.affectedAreas.map(String) : [],
          mitigationSuggestion: String(b.mitigationSuggestion || ''),
        })),
        logicGaps: (parsed.logicGaps || []).map((g: Record<string, unknown>, i: number) => ({
          id: String(g.id || `gap_${i}`),
          description: String(g.description || ''),
          location: String(g.location || ''),
          severity: (['critical', 'high', 'medium', 'low'].includes(String(g.severity))
            ? g.severity
            : 'medium') as 'critical' | 'high' | 'medium' | 'low',
          type: String(g.type || 'missing_evidence') as LogicGap['type'],
          suggestedRemedy: String(g.suggestedRemedy || ''),
        })),
        metaObservations: (parsed.metaObservations || []).map(
          (m: Record<string, unknown>, i: number) => ({
            id: String(m.id || `meta_${i}`),
            observation: String(m.observation || ''),
            category: (['process', 'quality', 'coverage', 'methodology', 'epistemology'].includes(
              String(m.category)
            )
              ? m.category
              : 'quality') as MetaObservation['category'],
            insight: String(m.insight || ''),
            actionable: Boolean(m.actionable),
            suggestedAction: m.suggestedAction ? String(m.suggestedAction) : undefined,
          })
        ),
        calibratedConfidence: Math.max(0, Math.min(1, Number(parsed.calibratedConfidence) || 0.5)),
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map(String)
          : [],
        summary: String(parsed.summary || 'Reflection analysis complete.'),
        timestamp: Date.now(),
      };
    } catch (error) {
      log.error('Failed to parse reflection response', { error });
      return this.createDefaultReflection(context.phase);
    }
  }

  private createDefaultReflection(phase: ReflectionContext['phase']): ReflectionResult {
    return {
      qualityScore: 0.5,
      assumptions: [],
      biases: [],
      logicGaps: [],
      metaObservations: [
        {
          id: 'meta_default',
          observation: 'Reflection analysis could not be completed',
          category: 'process',
          insight: 'The reflection system encountered an issue',
          actionable: false,
        },
      ],
      calibratedConfidence: 0.5,
      recommendations: ['Review findings manually'],
      summary: `Reflection for ${phase} phase could not be fully completed.`,
      timestamp: Date.now(),
    };
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'synthesis_progress',
        message: `[Reflection] ${message}`,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createReflectionEngine(
  client: Anthropic,
  onStream?: StrategyStreamCallback
): ReflectionEngine {
  return new ReflectionEngine(client, onStream);
}
